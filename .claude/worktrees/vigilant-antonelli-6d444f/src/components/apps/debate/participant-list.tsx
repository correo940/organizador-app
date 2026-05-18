import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserMinus, MessageSquareOff } from 'lucide-react';
import { RoleBadge } from './role-badge';
import { useDebatePermissions } from '@/lib/hooks/useDebatePermissions';
import { toast } from 'sonner';

interface Participant {
    id: string;
    email: string;
    role: 'admin' | 'moderator' | 'participant';
}

interface ParticipantListProps {
    debateId: string;
    currentUserId: string;
}

export function ParticipantList({ debateId, currentUserId }: ParticipantListProps) {
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(true);
    const permissions = useDebatePermissions(debateId);

    useEffect(() => {
        fetchParticipants();

        // Subscribe to role changes
        const subscription = supabase
            .channel(`debate_roles:${debateId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'debate_roles',
                filter: `debate_id=eq.${debateId}`
            }, () => {
                fetchParticipants();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [debateId]);

    const fetchParticipants = async () => {
        try {
            // Get debate info to know creator and guest
            const { data: debate } = await supabase
                .from('debate_rooms')
                .select('creator_id, guest_id')
                .eq('id', debateId)
                .single();

            if (!debate) return;

            // Get all participants (creator, guest, and anyone with a role)
            const participantIds = new Set<string>();
            if (debate.creator_id) participantIds.add(debate.creator_id);
            if (debate.guest_id) participantIds.add(debate.guest_id);

            // Get user profiles from profiles table instead of auth admin API
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, email, full_name')
                .in('id', Array.from(participantIds));

            // Get roles
            const { data: roles } = await supabase
                .from('debate_roles')
                .select('user_id, role')
                .eq('debate_id', debateId);

            const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

            const participantList: Participant[] = Array.from(participantIds).map(userId => {
                const profile = profiles?.find(p => p.id === userId);
                const role = debate.creator_id === userId ? 'admin' : (roleMap.get(userId) as any || 'participant');

                return {
                    id: userId,
                    email: profile?.email || profile?.full_name || 'Usuario',
                    role,
                };
            });

            setParticipants(participantList);
        } catch (error) {
            console.error('Error fetching participants:', error);
            toast.error('Error al cargar participantes');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            const { error } = await supabase.rpc('assign_debate_role', {
                p_debate_id: debateId,
                p_user_id: userId,
                p_role: newRole,
            });

            if (error) throw error;

            toast.success('Rol actualizado correctamente');
            fetchParticipants();
        } catch (error: any) {
            console.error('Error updating role:', error);
            toast.error(error.message || 'Error al actualizar el rol');
        }
    };

    const getInitials = (email: string) => {
        return email.substring(0, 2).toUpperCase();
    };

    if (loading) {
        return <div className="p-4 text-center text-muted-foreground">Cargando...</div>;
    }

    return (
        <ScrollArea className="h-[400px]">
            <div className="space-y-2 p-2">
                {participants.map((participant) => (
                    <div
                        key={participant.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                        <div className="flex items-center gap-3 flex-1">
                            <Avatar className="w-8 h-8">
                                <AvatarFallback className="text-xs">
                                    {getInitials(participant.email)}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{participant.email}</div>
                                {participant.id === currentUserId && (
                                    <span className="text-xs text-muted-foreground">(Tú)</span>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {permissions.isSuperAdmin && <RoleBadge role="super_admin" />}
                                {participant.role === 'admin' && <RoleBadge role="admin" />}
                                {participant.role === 'moderator' && <RoleBadge role="moderator" />}
                            </div>
                        </div>

                        {permissions.canAssignRoles && participant.id !== currentUserId && participant.role !== 'admin' && (
                            <Select
                                value={participant.role}
                                onValueChange={(value) => handleRoleChange(participant.id, value)}
                            >
                                <SelectTrigger className="w-[130px] ml-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="moderator">Moderador</SelectItem>
                                    <SelectItem value="participant">Participante</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}
