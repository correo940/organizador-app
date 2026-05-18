'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Link as LinkIcon, Trash2, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreateThoughtDialog } from '@/components/apps/mi-hogar/confessions/create-thought-dialog';
import { ShareDialog } from '@/components/apps/mi-hogar/confessions/share-dialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

type Thought = {
    id: string;
    share_token: string;
    is_anonymous: boolean;
    creator_name: string | null;
    created_at: string;
    message_count: number;
    last_message_at: string | null;
};

export default function CompartirPensamientosPage() {
    const router = useRouter();
    const [thoughts, setThoughts] = useState<Thought[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [shareThought, setShareThought] = useState<Thought | null>(null);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push('/login');
            return;
        }
        setUser(user);
        fetchThoughts();
    };

    const fetchThoughts = async () => {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('shared_thoughts')
            .select(`
                id,
                share_token,
                is_anonymous,
                creator_name,
                created_at,
                deleted_by_creator
            `)
            .eq('creator_id', user.id)
            .eq('deleted_by_creator', false)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching thoughts:', error);
        } else {
            // Get message counts for each thought
            const enriched = await Promise.all(
                (data || []).map(async (thought) => {
                    const { count } = await supabase
                        .from('thought_messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('thought_id', thought.id);

                    const { data: lastMsg } = await supabase
                        .from('thought_messages')
                        .select('created_at')
                        .eq('thought_id', thought.id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();

                    return {
                        ...thought,
                        message_count: count || 0,
                        last_message_at: lastMsg?.created_at || null
                    };
                })
            );

            setThoughts(enriched);
        }
        setIsLoading(false);
    };

    const handleDelete = async (thoughtId: string) => {
        const { error } = await supabase
            .from('shared_thoughts')
            .update({ deleted_by_creator: true })
            .eq('id', thoughtId);

        if (error) {
            toast.error('Error al eliminar');
        } else {
            toast.success('Pensamiento eliminado');
            fetchThoughts();
        }
    };

    const handleShare = (thought: Thought) => {
        setShareThought(thought);
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="space-y-4 w-full max-w-sm px-4">
                    <div className="h-8 w-48 bg-slate-200/60 rounded-xl animate-pulse mx-auto" />
                    <div className="h-4 w-64 bg-slate-200/40 rounded-lg animate-pulse mx-auto" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4">
            {/* Header */}
            <header className="max-w-4xl mx-auto mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-violet-500/10 rounded-lg">
                            <span className="text-3xl">🤔</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Compartir Pensamientos</h1>
                            <p className="text-sm text-muted-foreground">
                                Crea un pensamiento y compártelo por enlace
                            </p>
                        </div>
                    </div>
                    <Button onClick={() => setShowCreateDialog(true)} size="lg">
                        <Plus className="w-5 h-5 mr-2" />
                        Nuevo Pensamiento
                    </Button>
                </div>
            </header>

            {/* Thoughts List */}
            <main className="max-w-4xl mx-auto">
                {isLoading ? (
                    <div className="space-y-4 py-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="rounded-xl border border-slate-200/50 p-5 space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="h-5 w-20 bg-slate-200/60 rounded-full animate-pulse" />
                                    <div className="h-3 w-24 bg-slate-200/40 rounded animate-pulse" />
                                </div>
                                <div className="h-3 w-32 bg-slate-200/40 rounded animate-pulse" />
                                <div className="flex gap-2">
                                    <div className="h-9 flex-1 bg-slate-200/40 rounded-lg animate-pulse" />
                                    <div className="h-9 flex-1 bg-slate-200/40 rounded-lg animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : thoughts.length === 0 ? (
                    <Card className="text-center py-12">
                        <CardContent>
                            <span className="text-6xl mb-4 block">🤔</span>
                            <h2 className="text-xl font-semibold mb-2">Sin pensamientos aún</h2>
                            <p className="text-muted-foreground mb-6">
                                Crea tu primer pensamiento y compártelo con alguien
                            </p>
                            <Button onClick={() => setShowCreateDialog(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Crear Primer Pensamiento
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <ScrollArea className="h-[calc(100vh-200px)]">
                        <div className="space-y-4">
                            {thoughts.map((thought) => (
                                <motion.div
                                    key={thought.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <Card className="hover:border-primary/50 transition-colors">
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        {thought.is_anonymous ? (
                                                            <Badge variant="secondary">🤫 Anónimo</Badge>
                                                        ) : (
                                                            <Badge variant="outline">{thought.creator_name}</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        Creado {formatDistanceToNow(new Date(thought.created_at), {
                                                            addSuffix: true,
                                                            locale: es
                                                        })}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(thought.id)}
                                                >
                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <MessageCircle className="w-4 h-4" />
                                                    {thought.message_count} mensaje{thought.message_count !== 1 ? 's' : ''}
                                                </span>
                                                {thought.last_message_at && (
                                                    <span>
                                                        Última actividad: {formatDistanceToNow(new Date(thought.last_message_at), {
                                                            addSuffix: true,
                                                            locale: es
                                                        })}
                                                    </span>
                                                )}
                                            </div>
                                        </CardContent>
                                        <CardFooter className="gap-2">
                                            <Button
                                                variant="outline"
                                                className="flex-1"
                                                onClick={() => handleShare(thought)}
                                            >
                                                <LinkIcon className="w-4 h-4 mr-2" />
                                                Compartir Enlace
                                            </Button>
                                            <Button
                                                variant="default"
                                                className="flex-1"
                                                onClick={() => router.push(`/apps/mi-hogar/confessions/${thought.id}`)}
                                            >
                                                Ver Conversación
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </main>

            {/* Dialogs */}
            <CreateThoughtDialog
                isOpen={showCreateDialog}
                onClose={() => setShowCreateDialog(false)}
                onCreated={() => {
                    setShowCreateDialog(false);
                    fetchThoughts();
                }}
            />

            {shareThought && (
                <ShareDialog
                    thought={shareThought}
                    onClose={() => setShareThought(null)}
                />
            )}
        </div>
    );
}
