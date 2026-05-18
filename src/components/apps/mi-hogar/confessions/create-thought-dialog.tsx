'use client';

import { useState, useRef } from 'react';
import { Send, Mic, Video, Type, Square, Trash2, Shield, Lock, MessageCircle, Clock } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Webcam from 'react-webcam';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (shareToken: string) => void;
};

export function CreateThoughtDialog({ isOpen, onClose, onCreated }: Props) {
    const [activeTab, setActiveTab] = useState<'text' | 'audio' | 'video'>('text');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [creatorName, setCreatorName] = useState('');
    const [textContent, setTextContent] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // New Interaction Modes
    const [interactionMode, setInteractionMode] = useState<'conversation' | 'read_only' | 'app_only'>('conversation');
    const [unlockAt, setUnlockAt] = useState<Date | undefined>(undefined);

    // Audio state
    const [audioRecording, setAudioRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const audioRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Video state
    const [videoRecording, setVideoRecording] = useState(false);
    const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const videoRecorderRef = useRef<MediaRecorder | null>(null);
    const videoChunksRef = useRef<Blob[]>([]);
    const webcamRef = useRef<Webcam>(null);

    const resetState = () => {
        setActiveTab('text');
        setIsAnonymous(false);
        setCreatorName('');
        setTextContent('');
        setVideoBlob(null);
        setVideoUrl(null);
        setInteractionMode('conversation');
        setUnlockAt(undefined);
    };

    const handleCreate = async () => {
        if (!isAnonymous && !creatorName.trim()) {
            toast.error('Escribe tu nombre o activa el modo anónimo');
            return;
        }

        let contentType = activeTab;
        let content = '';

        if (activeTab === 'text') {
            if (!textContent.trim()) {
                toast.error('Escribe tu pensamiento');
                return;
            }
            content = textContent.trim();
        } else if (activeTab === 'audio') {
            if (!audioBlob) {
                toast.error('Graba un audio primero');
                return;
            }
            content = await uploadMedia(audioBlob, 'audio');
        } else if (activeTab === 'video') {
            if (!videoBlob) {
                toast.error('Graba un video primero');
                return;
            }
            content = await uploadMedia(videoBlob, 'video');
        }

        if (!content) return;

        setIsCreating(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Generate share token
            const { data: tokenData, error: tokenError } = await supabase
                .rpc('generate_share_token');

            if (tokenError) throw tokenError;
            const shareToken = tokenData;

            // Create thought
            const { data: thought, error: thoughtError } = await supabase
                .from('shared_thoughts')
                .insert({
                    creator_id: user.id,
                    share_token: shareToken,
                    is_anonymous: isAnonymous,
                    creator_name: isAnonymous ? null : creatorName.trim(),
                    interaction_mode: interactionMode,
                    unlock_at: unlockAt ? unlockAt.toISOString() : null
                })
                .select()
                .single();

            if (thoughtError) throw thoughtError;

            // Create initial message
            const { error: msgError } = await supabase
                .from('thought_messages')
                .insert({
                    thought_id: thought.id,
                    sender_type: 'creator',
                    type: contentType,
                    content: content
                });

            if (msgError) throw msgError;

            toast.success('¡Pensamiento creado!');
            resetState();
            onCreated(shareToken);
        } catch (error) {
            console.error('Error creating thought:', error);
            toast.error('Error al crear pensamiento');
        } finally {
            setIsCreating(false);
        }
    };

    const uploadMedia = async (blob: Blob, type: 'audio' | 'video'): Promise<string> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const extension = type === 'audio' ? 'webm' : 'webm';
        const fileName = `${user.id}/${Date.now()}_${type}.${extension}`;

        const { error: uploadError } = await supabase.storage
            .from('confessions')
            .upload(fileName, blob);

        if (uploadError) throw uploadError;

        return fileName;
    };

    // Audio handlers
    const startAudioRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                setAudioUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            audioRecorderRef.current = recorder;
            setAudioRecording(true);
        } catch (error) {
            toast.error('Error al acceder al micrófono');
        }
    };

    const stopAudioRecording = () => {
        if (audioRecorderRef.current && audioRecording) {
            audioRecorderRef.current.stop();
            setAudioRecording(false);
        }
    };

    // Video handlers
    const startVideoRecording = async () => {
        if (!webcamRef.current?.stream) {
            toast.error('Cámara no disponible');
            return;
        }

        const recorder = new MediaRecorder(webcamRef.current.stream);
        videoChunksRef.current = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) videoChunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
            setVideoBlob(blob);
            setVideoUrl(URL.createObjectURL(blob));
        };

        recorder.start();
        videoRecorderRef.current = recorder;
        setVideoRecording(true);
    };

    const stopVideoRecording = () => {
        if (videoRecorderRef.current && videoRecording) {
            videoRecorderRef.current.stop();
            setVideoRecording(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Crear Nuevo Pensamiento</DialogTitle>
                    <DialogDescription>
                        Comparte lo que piensas de forma texto, audio o video
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Anonymous toggle */}
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                            <Label htmlFor="anonymous">Enviar como anónimo</Label>
                            <p className="text-xs text-muted-foreground">
                                El receptor no sabrá quién eres
                            </p>
                        </div>
                        <Switch
                            id="anonymous"
                            checked={isAnonymous}
                            onCheckedChange={setIsAnonymous}
                        />
                    </div>

                    {/* Creator name */}
                    {!isAnonymous && (
                        <div>
                            <Label htmlFor="name">Tu nombre</Label>
                            <Input
                                id="name"
                                placeholder="Ej: María, Juan, etc."
                                value={creatorName}
                                onChange={(e) => setCreatorName(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Interaction Mode Selection */}
                    <div className="space-y-3">
                        <Label>Modo de Interacción</Label>
                        <RadioGroup
                            value={interactionMode}
                            onValueChange={(v) => setInteractionMode(v as any)}
                            className="grid grid-cols-1 md:grid-cols-3 gap-4"
                        >
                            {/* Standard Conversation */}
                            <Label
                                htmlFor="mode-conversation"
                                className={cn(
                                    "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer",
                                    interactionMode === 'conversation' && "border-primary bg-primary/5"
                                )}
                            >
                                <RadioGroupItem value="conversation" id="mode-conversation" className="sr-only" />
                                <MessageCircle className="mb-3 h-6 w-6" />
                                <div className="text-center space-y-1">
                                    <div className="font-semibold">Conversación</div>
                                    <div className="text-xs text-muted-foreground">Chat normal y fluido</div>
                                </div>
                            </Label>

                            {/* App Only */}
                            <Label
                                htmlFor="mode-app-only"
                                className={cn(
                                    "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer",
                                    interactionMode === 'app_only' && "border-primary bg-primary/5"
                                )}
                            >
                                <RadioGroupItem value="app_only" id="mode-app-only" className="sr-only" />
                                <Shield className="mb-3 h-6 w-6" />
                                <div className="text-center space-y-1">
                                    <div className="font-semibold">Solo App</div>
                                    <div className="text-xs text-muted-foreground">Privado, sin hablar en persona</div>
                                </div>
                            </Label>

                            {/* Read Only */}
                            <Label
                                htmlFor="mode-read-only"
                                className={cn(
                                    "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer",
                                    interactionMode === 'read_only' && "border-primary bg-primary/5"
                                )}
                            >
                                <RadioGroupItem value="read_only" id="mode-read-only" className="sr-only" />
                                <Lock className="mb-3 h-6 w-6" />
                                <div className="text-center space-y-1">
                                    <div className="font-semibold">Solo Lectura</div>
                                    <div className="text-xs text-muted-foreground">El receptor solo puede ver</div>
                                </div>
                            </Label>
                        </RadioGroup>
                    </div>

                    {/* Time Capsule (Optional) */}
                    <div className="flex flex-col space-y-2">
                        <Label>Cápsula del Tiempo (Opcional)</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !unlockAt && "text-muted-foreground"
                                    )}
                                >
                                    <Clock className="mr-2 h-4 w-4" />
                                    {unlockAt ? (
                                        format(unlockAt, "PPP 'a las' p", { locale: es })
                                    ) : (
                                        <span>Disponible inmediatamente</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={unlockAt}
                                    onSelect={setUnlockAt}
                                    initialFocus
                                    disabled={(date) => date < new Date()}
                                />
                                <div className="p-3 border-t">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => setUnlockAt(undefined)}
                                    >
                                        Limpiar (Inmediato)
                                    </Button>
                                    <p className="text-xs text-center text-muted-foreground mt-2">
                                        * Se necesita definir la hora exacta en una versión futura, por ahora es medianoche del día seleccionado.
                                    </p>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Content tabs */}
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="text">
                                <Type className="w-4 h-4 mr-2" />
                                Texto
                            </TabsTrigger>
                            <TabsTrigger value="audio">
                                <Mic className="w-4 h-4 mr-2" />
                                Audio
                            </TabsTrigger>
                            <TabsTrigger value="video">
                                <Video className="w-4 h-4 mr-2" />
                                Video
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="text">
                            <Textarea
                                placeholder="Escribe tu pensamiento..."
                                value={textContent}
                                onChange={(e) => setTextContent(e.target.value)}
                                rows={6}
                            />
                        </TabsContent>

                        <TabsContent value="audio">
                            <div className="border rounded-lg p-4 space-y-3">
                                {!audioUrl ? (
                                    <Button
                                        onClick={audioRecording ? stopAudioRecording : startAudioRecording}
                                        variant={audioRecording ? 'destructive' : 'default'}
                                        className="w-full"
                                    >
                                        {audioRecording ? (
                                            <>
                                                <Square className="w-4 h-4 mr-2" />
                                                Detener Grabación
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
                                        <audio controls src={audioUrl} className="w-full" />
                                        <Button
                                            onClick={() => {
                                                setAudioBlob(null);
                                                setAudioUrl(null);
                                            }}
                                            variant="outline"
                                            className="w-full"
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Eliminar y Grabar Nuevo
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="video">
                            <div className="border rounded-lg p-4 space-y-3">
                                {!videoUrl ? (
                                    <>
                                        <Webcam
                                            ref={webcamRef}
                                            audio={true}
                                            className="w-full rounded-lg"
                                            videoConstraints={{
                                                facingMode: 'user'
                                            }}
                                        />
                                        <Button
                                            onClick={videoRecording ? stopVideoRecording : startVideoRecording}
                                            variant={videoRecording ? 'destructive' : 'default'}
                                            className="w-full"
                                        >
                                            {videoRecording ? (
                                                <>
                                                    <Square className="w-4 h-4 mr-2" />
                                                    Detener Grabación
                                                </>
                                            ) : (
                                                <>
                                                    <Video className="w-4 h-4 mr-2" />
                                                    Grabar Video
                                                </>
                                            )}
                                        </Button>
                                    </>
                                ) : (
                                    <div className="space-y-3">
                                        <video controls src={videoUrl} className="w-full rounded-lg" />
                                        <Button
                                            onClick={() => {
                                                setVideoBlob(null);
                                                setVideoUrl(null);
                                            }}
                                            variant="outline"
                                            className="w-full"
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Eliminar y Grabar Nuevo
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleCreate} disabled={isCreating}>
                        {isCreating ? 'Creando...' : 'Crear y Generar Enlace'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
