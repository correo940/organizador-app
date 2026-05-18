'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

type Conversation = {
    id: string;
    participant_id: string;
    last_message_at: string | null;
    other_user: {
        id: string;
        email: string;
    };
    unread_count: number;
    is_paused: boolean;
    resume_at: string | null;
};

type Props = {
    selectedId: string | null;
    onSelect: (id: string) => void;
    userId: string;
};

export function ConversationList({ selectedId, onSelect, userId }: Props) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchConversations();

        // Real-time subscription
        const channel = supabase
            .channel('conversations_channel')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'conversations'
            }, () => {
                fetchConversations();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    const fetchConversations = async () => {
        setIsLoading(true);

        // Fetch all conversations where user is a participant
        const { data: convData, error: convError } = await supabase
            .from('conversations')
            .select(`
                id,
                participant_id,
                last_message_at,
                unread_count_user1,
                unread_count_user2,
                conversation_participants!inner (
                    user_id_1,
                    user_id_2
                )
            `)
            .order('last_message_at', { ascending: false, nullsFirst: false });

        if (convError) {
            console.error('Error fetching conversations:', convError);
            setIsLoading(false);
            return;
        }

        if (!convData || convData.length === 0) {
            setConversations([]);
            setIsLoading(false);
            return;
        }

        // For each conversation, get other user info and pause status
        const enrichedConversations = await Promise.all(
            convData.map(async (conv: any) => {
                const participant = conv.conversation_participants;
                const otherUserId = participant.user_id_1 === userId
                    ? participant.user_id_2
                    : participant.user_id_1;

                // Fetch other user's email from auth.users (via profiles if you have one)
                const { data: userData } = await supabase
                    .rpc('get_user_email', { user_id: otherUserId });

                // Check for active pause
                const { data: pauseData } = await supabase
                    .from('conversation_pauses')
                    .select('*')
                    .eq('conversation_id', conv.id)
                    .eq('is_active', true)
                    .gt('resume_at', new Date().toISOString())
                    .single();

                // Determine unread count for current user
                const unreadCount = participant.user_id_1 === userId
                    ? conv.unread_count_user1
                    : conv.unread_count_user2;

                return {
                    id: conv.id,
                    participant_id: conv.participant_id,
                    last_message_at: conv.last_message_at,
                    other_user: {
                        id: otherUserId,
                        email: userData || 'Usuario'
                    },
                    unread_count: unreadCount,
                    is_paused: !!pauseData,
                    resume_at: pauseData?.resume_at || null
                };
            })
        );

        setConversations(enrichedConversations);
        setIsLoading(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <p className="text-sm text-muted-foreground">Cargando conversaciones...</p>
            </div>
        );
    }

    if (conversations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center">
                <User className="w-12 h-12 text-muted-foreground opacity-50 mb-2" />
                <p className="text-sm font-medium">Sin conversaciones</p>
                <p className="text-xs text-muted-foreground mt-1">
                    Inicia una nueva conversación para empezar
                </p>
            </div>
        );
    }

    return (
        <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
                {conversations.map((conv) => (
                    <motion.div
                        key={conv.id}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => onSelect(conv.id)}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedId === conv.id
                            ? 'bg-primary/10 border border-primary/20'
                            : 'hover:bg-muted/50'
                            }`}
                    >
                        <div className="flex items-start gap-3">
                            <Avatar className="w-10 h-10">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                    {conv.other_user.email.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-sm truncate">
                                        {conv.other_user.email}
                                    </span>
                                    {conv.last_message_at && (
                                        <span className="text-xs text-muted-foreground">
                                            {formatDistanceToNow(new Date(conv.last_message_at), {
                                                addSuffix: true,
                                                locale: es
                                            })}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {conv.is_paused && (
                                        <Badge variant="outline" className="text-xs">
                                            <Clock className="w-3 h-3 mr-1" />
                                            Pausada
                                        </Badge>
                                    )}
                                    {conv.unread_count > 0 && (
                                        <Badge variant="destructive" className="text-xs">
                                            {conv.unread_count}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </ScrollArea>
    );
}
