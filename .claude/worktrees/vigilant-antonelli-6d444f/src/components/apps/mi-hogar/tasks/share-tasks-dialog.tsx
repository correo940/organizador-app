import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, Key, Users, Copy, Mail, RefreshCw, Trash2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';

type Member = {
    user_id: string;
    role: 'owner' | 'editor' | 'viewer';
    nickname?: string;
    email?: string;
};

interface ShareTasksDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    listId: string;
    listName: string;
    isOwner: boolean;
    onListUpdated: () => void;
}

export function ShareTasksDialog({ open, onOpenChange, listId, listName, isOwner, onListUpdated }: ShareTasksDialogProps) {
    const [loading, setLoading] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [generatedCode, setGeneratedCode] = useState('');
    const [inputCode, setInputCode] = useState('');
    const { user } = useAuth();

    useEffect(() => {
        if (open && listId) {
            fetchMembers();
            setGeneratedCode('');
        }
    }, [open, listId]);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('task_list_members')
                .select(`
                    user_id,
                    role,
                    joined_at
                `)
                .eq('list_id', listId);

            if (error) throw error;

            // Fetch profiles for these users
            const userIds = data.map(m => m.user_id);
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, nickname, email') // Assuming email might be in profile or we handle it otherwise
                .in('id', userIds);

            // Map members with profile data
            const mappedMembers: Member[] = data.map(m => {
                const profile = profiles?.find(p => p.id === m.user_id);
                return {
                    user_id: m.user_id,
                    role: m.role,
                    nickname: profile?.nickname || 'Usuario',
                    email: profile?.email || '...'
                };
            });

            setMembers(mappedMembers);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar miembros');
        } finally {
            setLoading(false);
        }
    };

    const generateCode = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('generate_task_list_invitation', { p_list_id: listId });
            if (error) throw error;
            setGeneratedCode(data);
        } catch (error: any) {
            toast.error('Error al generar código: ' + (error.message || ''));
        } finally {
            setLoading(false);
        }
    };

    const copyCode = () => {
        navigator.clipboard.writeText(generatedCode);
        toast.success('Código copiado');
    };

    const handleSendEmail = () => {
        const subject = `Únete a la lista de tareas "${listName}" en Quioba`;
        const body = `Hola, \n\nQuiero compartir la lista de tareas "${listName}" contigo.\n\n1. Abre Tareas en Quioba.\n2. Dale a 'Unirme a Lista' (o usa el botón +).\n3. Introduce este código: ${generatedCode}\n\n¡A organizarse!`;
        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    };

    const removeMember = async (userId: string) => {
        if (!confirm('¿Seguro que quieres eliminar a este miembro?')) return;
        try {
            const { error } = await supabase
                .from('task_list_members')
                .delete()
                .match({ list_id: listId, user_id: userId });

            if (error) throw error;
            toast.success('Miembro eliminado');
            fetchMembers();
        } catch (error) {
            toast.error('Error al eliminar miembro');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        Compartir "{listName}"
                    </DialogTitle>
                    <DialogDescription>
                        Gestiona quién tiene acceso a esta lista de tareas.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    {/* Members List */}
                    <div className="bg-secondary/20 p-4 rounded-xl border mb-4">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-primary" />
                            Miembros ({members.length})
                        </h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                            {members.map((member) => (
                                <div key={member.user_id} className="flex items-center justify-between bg-card p-2 rounded border text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                            {member.nickname?.substring(0, 1).toUpperCase() || 'U'}
                                        </div>
                                        <div>
                                            <p className="font-medium text-xs">
                                                {member.nickname}
                                                {member.user_id === user?.id && <span className="text-muted-foreground ml-1">(Tú)</span>}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground capitalize">{member.role}</p>
                                        </div>
                                    </div>
                                    {isOwner && member.user_id !== user?.id && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 text-destructive hover:bg-destructive/10"
                                            onClick={() => removeMember(member.user_id)}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Generate Code Section - Only for Owners/Editors */}
                    {(isOwner || members.find(m => m.user_id === user?.id)?.role === 'editor') && (
                        <div className="space-y-3">
                            <Label className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Invitar Nuevo Miembro</Label>

                            {!generatedCode ? (
                                <Button onClick={generateCode} className="w-full" variant="outline">
                                    <Key className="w-4 h-4 mr-2" />
                                    Generar Código de Invitación
                                </Button>
                            ) : (
                                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border animate-in slide-in-from-top-2">
                                    <div className="text-center mb-4">
                                        <p className="text-xs text-muted-foreground mb-1">Comparte este código:</p>
                                        <p className="text-3xl font-mono font-bold tracking-[0.2em] text-primary">{generatedCode}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="secondary" className="flex-1" onClick={copyCode}>
                                            <Copy className="w-3 h-3 mr-2" /> Copiar
                                        </Button>
                                        <Button size="sm" variant="secondary" className="flex-1" onClick={handleSendEmail}>
                                            <Mail className="w-3 h-3 mr-2" /> Enviar
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={generateCode}>
                                            <RefreshCw className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-center text-muted-foreground mt-2">
                                        El código expira en 24 horas.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
