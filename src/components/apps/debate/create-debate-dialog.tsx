"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, MessageCircle, Type, Mic, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreateDebateDialogProps {
    children: React.ReactNode;
    onDebateCreated?: (debateId: string) => void;
}

type DebateMode = 'text' | 'voice' | 'both';

export function CreateDebateDialog({ children, onDebateCreated }: CreateDebateDialogProps) {
    const [open, setOpen] = useState(false);
    const [topic, setTopic] = useState("");
    const [description, setDescription] = useState("");
    const [isPublic, setIsPublic] = useState(true);
    const [loading, setLoading] = useState(false);

    // New options
    const [debateMode, setDebateMode] = useState<DebateMode>('both');
    const [maxCharacters, setMaxCharacters] = useState<number>(500);
    const [maxVoiceSeconds, setMaxVoiceSeconds] = useState<number>(60);

    const { toast } = useToast();

    const handleCreate = async () => {
        if (!topic.trim()) {
            toast({
                title: "Error",
                description: "El tema del debate es requerido",
                variant: "destructive"
            });
            return;
        }

        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast({
                title: "Error",
                description: "Debes iniciar sesión para crear un debate",
                variant: "destructive"
            });
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from('debate_rooms')
            .insert({
                topic: topic.trim(),
                description: description.trim(),
                is_public: isPublic,
                creator_id: user.id,
                status: 'waiting',
                debate_mode: debateMode,
                max_characters: maxCharacters,
                max_voice_seconds: maxVoiceSeconds
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating debate:', error);
            toast({
                title: "Error",
                description: "No se pudo crear el debate",
                variant: "destructive"
            });
        } else if (data) {
            toast({
                title: "¡Debate creado!",
                description: "Tu debate está listo para comenzar",
            });
            setOpen(false);
            resetForm();
            onDebateCreated?.(data.id);
        }

        setLoading(false);
    };

    const resetForm = () => {
        setTopic("");
        setDescription("");
        setIsPublic(true);
        setDebateMode('both');
        setMaxCharacters(500);
        setMaxVoiceSeconds(60);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-green-500" />
                        Crear Nuevo Debate
                    </DialogTitle>
                    <DialogDescription>
                        Configura las reglas de tu nuevo debate
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* Tema */}
                    <div className="space-y-2">
                        <Label htmlFor="topic">Tema del Debate *</Label>
                        <Input
                            id="topic"
                            placeholder="Ej: ¿Es mejor el café o el té?"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                        />
                    </div>

                    {/* Descripción */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción (opcional)</Label>
                        <Textarea
                            id="description"
                            placeholder="Añade más contexto al debate..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                        />
                    </div>

                    {/* Modo de debate */}
                    <div className="space-y-2">
                        <Label>Modo de Debate</Label>
                        <div className="grid grid-cols-3 gap-2">
                            <Button
                                type="button"
                                variant={debateMode === 'text' ? 'default' : 'outline'}
                                onClick={() => setDebateMode('text')}
                                className={debateMode === 'text' ? 'bg-green-500 hover:bg-green-800' : ''}
                            >
                                <Type className="w-4 h-4 mr-1" />
                                Texto
                            </Button>
                            <Button
                                type="button"
                                variant={debateMode === 'voice' ? 'default' : 'outline'}
                                onClick={() => setDebateMode('voice')}
                                className={debateMode === 'voice' ? 'bg-green-500 hover:bg-green-800' : ''}
                            >
                                <Mic className="w-4 h-4 mr-1" />
                                Voz
                            </Button>
                            <Button
                                type="button"
                                variant={debateMode === 'both' ? 'default' : 'outline'}
                                onClick={() => setDebateMode('both')}
                                className={debateMode === 'both' ? 'bg-green-500 hover:bg-green-800' : ''}
                            >
                                <MessageSquare className="w-4 h-4 mr-1" />
                                Ambos
                            </Button>
                        </div>
                    </div>

                    {/* Límite de caracteres (solo si permite texto) */}
                    {(debateMode === 'text' || debateMode === 'both') && (
                        <div className="space-y-2">
                            <Label>Máximo de caracteres por mensaje</Label>
                            <Select
                                value={maxCharacters.toString()}
                                onValueChange={(v) => setMaxCharacters(parseInt(v))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="100">100 caracteres</SelectItem>
                                    <SelectItem value="200">200 caracteres</SelectItem>
                                    <SelectItem value="500">500 caracteres</SelectItem>
                                    <SelectItem value="1000">1000 caracteres</SelectItem>
                                    <SelectItem value="2000">2000 caracteres</SelectItem>
                                    <SelectItem value="0">Sin límite</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Límite de tiempo de voz (solo si permite voz) */}
                    {(debateMode === 'voice' || debateMode === 'both') && (
                        <div className="space-y-2">
                            <Label>Tiempo máximo de audio</Label>
                            <Select
                                value={maxVoiceSeconds.toString()}
                                onValueChange={(v) => setMaxVoiceSeconds(parseInt(v))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="30">30 segundos</SelectItem>
                                    <SelectItem value="60">1 minuto</SelectItem>
                                    <SelectItem value="120">2 minutos</SelectItem>
                                    <SelectItem value="180">3 minutos</SelectItem>
                                    <SelectItem value="300">5 minutos</SelectItem>
                                    <SelectItem value="0">Sin límite</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Visibilidad */}
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <div>
                            <Label>Debate Público</Label>
                            <p className="text-xs text-muted-foreground">
                                Cualquier persona puede unirse
                            </p>
                        </div>
                        <Switch
                            checked={isPublic}
                            onCheckedChange={setIsPublic}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleCreate}
                        disabled={loading || !topic.trim()}
                        className="bg-gradient-to-r from-green-800 to-teal-600 text-white"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                            <MessageCircle className="w-4 h-4 mr-2" />
                        )}
                        Crear Debate
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

