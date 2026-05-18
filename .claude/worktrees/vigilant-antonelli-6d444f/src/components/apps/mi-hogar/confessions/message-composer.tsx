'use client';

import { useState } from 'react';
import { Send, Mic, Video, Type, Square, Trash2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type Props = {
    onSend: (type: 'text' | 'audio' | 'video', content: string, intonation?: string) => Promise<void>;
    disabled?: boolean;
    placeholder?: string;
};

const INTONATIONS = [
    { label: 'Enfadado', emoji: '😠', value: 'angry', color: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200' },
    { label: 'Feliz', emoji: '😊', value: 'happy', color: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200' },
    { label: 'Bromeando', emoji: '🤪', value: 'joking', color: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-200' },
    { label: 'Serio', emoji: '😐', value: 'serious', color: 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200' },
    { label: 'Triste', emoji: '😢', value: 'sad', color: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200' },
    { label: 'Sarcástico', emoji: '🙄', value: 'sarcastic', color: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200' },
];

export function MessageComposer({ onSend, disabled, placeholder }: Props) {
    const [activeTab, setActiveTab] = useState<'text' | 'audio' | 'video'>('text');
    const [textContent, setTextContent] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
    const [mediaUrl, setMediaUrl] = useState<string | null>(null);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const [selectedIntonation, setSelectedIntonation] = useState<string | null>(null);

    const handleSendText = async () => {
        if (!textContent.trim()) return;

        setIsSending(true);
        try {
            await onSend('text', textContent.trim(), selectedIntonation || undefined);
            setTextContent('');
            setSelectedIntonation(null); // Reset intonation after sending
            toast.success('Mensaje enviado');
        } catch (error) {
            toast.error('Error al enviar');
        } finally {
            setIsSending(false);
        }
    };

    const startRecording = async (type: 'audio' | 'video') => {
        try {
            const constraints = type === 'audio'
                ? { audio: true }
                : { audio: true, video: { facingMode: 'user' } };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            const recorder = new MediaRecorder(stream);
            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: `${type}/webm` });
                setMediaBlob(blob);
                setMediaUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
        } catch (error) {
            toast.error(`Error al acceder a ${type === 'audio' ? 'micrófono' : 'cámara'}`);
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
            setMediaRecorder(null);
        }
    };

    const sendMedia = async () => {
        if (!mediaBlob) return;

        setIsSending(true);
        try {
            const type = activeTab;
            const fileName = `public/${Date.now()}_${type}.webm`;

            const { error: uploadError } = await supabase.storage
                .from('confessions')
                .upload(fileName, mediaBlob);

            if (uploadError) throw uploadError;

            await onSend(type, fileName, selectedIntonation || undefined);
            setMediaBlob(null);
            setMediaUrl(null);
            setSelectedIntonation(null); // Reset intonation
            toast.success(`${type === 'audio' ? 'Audio' : 'Video'} enviado`);
        } catch (error) {
            toast.error('Error al enviar');
        } finally {
            setIsSending(false);
        }
    };

    const deleteMedia = () => {
        setMediaBlob(null);
        setMediaUrl(null);
    };

    return (
        <div className="p-4 bg-background border-t">
            {/* Intonation Selector */}
            <div className="mb-3">
                <ScrollArea className="w-full whitespace-nowrap pb-2">
                    <div className="flex w-max space-x-2 px-1">
                        {INTONATIONS.map((intonation) => (
                            <Badge
                                key={intonation.value}
                                variant="outline"
                                className={cn(
                                    "cursor-pointer transition-all hover:scale-105 py-1 px-3 border",
                                    intonation.color,
                                    selectedIntonation === intonation.value
                                        ? "ring-2 ring-offset-1 ring-primary scale-105 font-bold shadow-sm"
                                        : "opacity-70 hover:opacity-100"
                                )}
                                onClick={() => setSelectedIntonation(
                                    selectedIntonation === intonation.value ? null : intonation.value
                                )}
                            >
                                <span className="mr-1.5 text-base">{intonation.emoji}</span>
                                {intonation.label}
                            </Badge>
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="grid w-full grid-cols-3 mb-3">
                    <TabsTrigger value="text" disabled={disabled}>
                        <Type className="w-4 h-4 mr-2" />
                        Texto
                    </TabsTrigger>
                    <TabsTrigger value="audio" disabled={disabled}>
                        <Mic className="w-4 h-4 mr-2" />
                        Audio
                    </TabsTrigger>
                    <TabsTrigger value="video" disabled={disabled}>
                        <Video className="w-4 h-4 mr-2" />
                        Video
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="mt-0">
                    <div className="flex gap-2">
                        <Textarea
                            placeholder={disabled ? "Conversación pausada..." : (placeholder || "Escribe tu mensaje...")}
                            value={textContent}
                            onChange={(e) => setTextContent(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendText();
                                }
                            }}
                            disabled={disabled || isSending}
                            className="min-h-[50px] resize-none"
                        />
                        <Button
                            onClick={handleSendText}
                            disabled={disabled || !textContent.trim() || isSending}
                            size="icon"
                            className="h-[60px] w-[60px] shrink-0"
                        >
                            <Send className="w-5 h-5" />
                        </Button>
                    </div>
                </TabsContent>

                <TabsContent value="audio" className="mt-0">
                    <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                        {!mediaUrl ? (
                            <Button
                                onClick={() => isRecording ? stopRecording() : startRecording('audio')}
                                disabled={disabled}
                                variant={isRecording ? 'destructive' : 'default'}
                                className="w-full relative overflow-hidden"
                            >
                                {isRecording ? (
                                    <>
                                        <span className="animate-pulse absolute inset-0 bg-red-600/20" />
                                        <Square className="w-4 h-4 mr-2 relative z-10" />
                                        <span className="relative z-10">Detener Grabación</span>
                                    </>
                                ) : (
                                    <>
                                        <Mic className="w-4 h-4 mr-2" />
                                        Grabar Audio
                                    </>
                                )}
                            </Button>
                        ) : (
                            <div className="space-y-3">
                                <audio controls src={mediaUrl} className="w-full" />
                                <div className="flex gap-2">
                                    <Button onClick={sendMedia} disabled={isSending} className="flex-1">
                                        <Send className="w-4 h-4 mr-2" />
                                        Enviar Audio
                                    </Button>
                                    <Button onClick={deleteMedia} variant="destructive" size="icon">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="video" className="mt-0">
                    <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                        {!mediaUrl ? (
                            <Button
                                onClick={() => isRecording ? stopRecording() : startRecording('video')}
                                disabled={disabled}
                                variant={isRecording ? 'destructive' : 'default'}
                                className="w-full relative overflow-hidden"
                            >
                                {isRecording ? (
                                    <>
                                        <span className="animate-pulse absolute inset-0 bg-red-600/20" />
                                        <Square className="w-4 h-4 mr-2 relative z-10" />
                                        <span className="relative z-10">Detener Grabación</span>
                                    </>
                                ) : (
                                    <>
                                        <Video className="w-4 h-4 mr-2" />
                                        Grabar Video
                                    </>
                                )}
                            </Button>
                        ) : (
                            <div className="space-y-3">
                                <video controls src={mediaUrl} className="w-full rounded-md bg-black max-h-[300px]" />
                                <div className="flex gap-2">
                                    <Button onClick={sendMedia} disabled={isSending} className="flex-1">
                                        <Send className="w-4 h-4 mr-2" />
                                        Enviar Video
                                    </Button>
                                    <Button onClick={deleteMedia} variant="destructive" size="icon">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {disabled && (
                <p className="text-xs text-center text-orange-600 mt-2 font-medium">
                    ⚠️ La conversación está pausada
                </p>
            )}
        </div>
    );
}
