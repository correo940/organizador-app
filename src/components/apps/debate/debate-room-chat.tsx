"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    ArrowLeft, Send, Loader2, Users, Trophy, Sword,
    ThumbsUp, ThumbsDown, Meh
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { DebateManagementPanel } from "./debate-management-panel";
import { RoleBadge } from "./role-badge";
import { useDebatePermissions } from "@/lib/hooks/useDebatePermissions";
import { MessageActionMenu } from "./message-action-menu";
import { DeletedMessage } from "./deleted-message";
import { useUserRestrictions } from "@/lib/hooks/useUserRestrictions";
import { cn } from "@/lib/utils";
import { usePendingReports } from "@/lib/hooks/usePendingReports";

interface Message {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
    type: 'text' | 'audio' | 'image' | 'video';
    media_url?: string;
    sender: { full_name: string; avatar_url: string } | null;
    deleted_at?: string;
    deleted_by?: string;
}

interface DebateRoom {
    id: string;
    topic: string;
    status: 'waiting' | 'active' | 'voting' | 'finished';
    creator_id: string;
    guest_id: string | null;
    creator_score: number;
    guest_score: number;
    creator: { full_name: string; avatar_url: string } | null;
    guest: { full_name: string; avatar_url: string } | null;
}

interface DebateRoomChatProps {
    roomId: string;
    onBack: () => void;
}

export function DebateRoomChat({ roomId, onBack }: DebateRoomChatProps) {
    const [room, setRoom] = useState<DebateRoom | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const permissions = useDebatePermissions(roomId);
    const restriction = useUserRestrictions(roomId, currentUser?.id);
    const pendingReports = usePendingReports(roomId);

    // Fetch room and messages
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);

            // Small delay to handle race condition after creation
            await new Promise(resolve => setTimeout(resolve, 500));

            // Fetch room (simple query without relations)
            const { data: roomData, error: roomError } = await supabase
                .from('debate_rooms')
                .select('*')
                .eq('id', roomId)
                .single();

            if (roomError) console.error('Error fetching room:', roomError);

            if (roomData) {
                // Fetch creator and guest profiles separately
                const [creatorResult, guestResult] = await Promise.all([
                    supabase.from('profiles').select('full_name, avatar_url').eq('id', roomData.creator_id).single(),
                    roomData.guest_id ? supabase.from('profiles').select('full_name, avatar_url').eq('id', roomData.guest_id).single() : Promise.resolve({ data: null })
                ]);

                setRoom({
                    ...roomData,
                    creator: creatorResult.data,
                    guest: guestResult.data
                });
            }

            // Fetch messages (simple query, will add sender info in the map)
            const { data: messagesData } = await supabase
                .from('debate_messages')
                .select('*')
                .eq('room_id', roomId)
                .order('created_at', { ascending: true });

            if (messagesData && messagesData.length > 0) {
                // Get unique sender IDs
                const senderIds = [...new Set(messagesData.map(m => m.sender_id))];

                // Fetch all senders at once
                const { data: sendersData } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url, custom_avatar_url')
                    .in('id', senderIds);

                const sendersMap = new Map(sendersData?.map(s => [s.id, {
                    ...s,
                    avatar_url: s.custom_avatar_url || s.avatar_url
                }]) || []);

                // Add sender info to messages
                const messagesWithSenders = messagesData.map(m => ({
                    ...m,
                    sender: sendersMap.get(m.sender_id) || null
                }));

                setMessages(messagesWithSenders);
            } else {
                setMessages([]);
            }

            setLoading(false);
        };

        fetchData();

        // Real-time subscription for messages
        const channel = supabase
            .channel(`debate_messages_${roomId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'debate_messages',
                filter: `room_id=eq.${roomId}`
            }, async (payload) => {
                // Fetch the new message (simple query)
                const { data: msgData } = await supabase
                    .from('debate_messages')
                    .select('*')
                    .eq('id', payload.new.id)
                    .single();

                if (msgData) {
                    // Fetch sender
                    const { data: senderData } = await supabase
                        .from('profiles')
                        .select('id, full_name, avatar_url, custom_avatar_url')
                        .eq('id', msgData.sender_id)
                        .single();

                    const finalSender = senderData ? {
                        ...senderData,
                        avatar_url: senderData.custom_avatar_url || senderData.avatar_url
                    } : null;

                    setMessages(prev => [...prev, { ...msgData, sender: finalSender }]);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        console.log('Attempting to send message:', { newMessage, currentUser: currentUser?.id, room: room?.id });

        if (!newMessage.trim() || !currentUser || !room) {
            console.log('Send blocked:', { hasMessage: !!newMessage.trim(), hasUser: !!currentUser, hasRoom: !!room });
            return;
        }

        if (restriction.isRestricted) {
            return; // Double check
        }

        setSending(true);
        const content = newMessage;
        setNewMessage("");

        console.log('Sending to Supabase...');
        const { data, error } = await supabase
            .from('debate_messages')
            .insert({
                room_id: room.id,
                sender_id: currentUser.id,
                content,
                type: 'text'
            })
            .select();

        if (error) {
            console.error('Error sending message:', error);
            setNewMessage(content); // Restore message on error
        } else if (data && data.length > 0) {
            console.log('Message sent successfully:', data);
            // Add message to list immediately (optimistic update)
            setMessages(prev => [...prev, {
                ...data[0],
                sender: {
                    id: currentUser.id,
                    full_name: 'Tú',
                    avatar_url: null
                }
            }]);
        }

        setSending(false);
    };

    // CSS con inline styles para layout fijo
    const containerStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    };

    const headerStyle: React.CSSProperties = {
        flexShrink: 0,
        height: 60,
        borderBottom: '1px solid hsl(var(--border))',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12
    };

    const messagesStyle: React.CSSProperties = {
        flex: 1,
        overflow: 'auto',
        padding: 16
    };

    const inputAreaStyle: React.CSSProperties = {
        flexShrink: 0,
        padding: 16,
        borderTop: '1px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--background))'
    };

    if (loading) {
        return (
            <div style={containerStyle} className="items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="mt-2 text-muted-foreground">Cargando debate...</p>
            </div>
        );
    }

    if (!room) {
        return (
            <div style={containerStyle} className="items-center justify-center bg-background">
                <p className="text-muted-foreground">Debate no encontrado</p>
            </div>
        );
    }

    const isParticipant = room.creator_id === currentUser?.id || room.guest_id === currentUser?.id;

    return (
        <div style={containerStyle} className="bg-background">
            {/* HEADER - Fijo arriba */}
            <div style={headerStyle} className="bg-background/95 backdrop-blur-sm">
                <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
                    <ArrowLeft className="w-5 h-5" />
                </Button>

                <div className="flex-1 min-w-0">
                    <h2 className="font-bold truncate">{room.topic}</h2>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" />
                        <span>{room.creator?.full_name} vs {room.guest?.full_name || "Esperando..."}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
                            <Trophy className="w-3 h-3 mr-1" />
                            {room.creator_score}
                        </Badge>
                        <span className="text-muted-foreground">vs</span>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                            <Trophy className="w-3 h-3 mr-1" />
                            {room.guest_score}
                        </Badge>
                    </div>

                    {currentUser && (
                        <DebateManagementPanel
                            debateId={roomId}
                            currentUserId={currentUser.id}
                            trigger={
                                (permissions.isSuperAdmin || permissions.role === 'admin' || permissions.role === 'moderator') ? (
                                    <div className="relative type-button cursor-pointer transition-transform hover:scale-105 active:scale-95">
                                        {permissions.isSuperAdmin && <RoleBadge role="super_admin" className="cursor-pointer" />}
                                        {permissions.role === 'admin' && !permissions.isSuperAdmin && <RoleBadge role="admin" className="cursor-pointer" />}
                                        {permissions.role === 'moderator' && <RoleBadge role="moderator" className="cursor-pointer" />}

                                        {pendingReports > 0 && (
                                            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-sm animate-in zoom-in">
                                                {pendingReports > 9 ? '9+' : pendingReports}
                                            </span>
                                        )}
                                    </div>
                                ) : undefined
                            }
                        />
                    )}
                </div>
            </div>


            {/* MENSAJES - Área scrollable */}
            <div style={messagesStyle}>
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <Sword className="w-12 h-12 mb-4 opacity-50" />
                        <p>El debate está listo.</p>
                        <p className="text-sm">¡Envía el primer mensaje!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((message) => {
                            const isMe = message.sender_id === currentUser?.id;
                            const isCreator = message.sender_id === room.creator_id;

                            return (
                                <div
                                    key={message.id}
                                    className={cn(
                                        "flex gap-2 group",
                                        isMe ? "justify-end" : "justify-start"
                                    )}
                                >
                                    {!isMe && (
                                        <Avatar className="w-8 h-8">
                                            <AvatarImage src={message.sender?.avatar_url} />
                                            <AvatarFallback>
                                                {message.sender?.full_name?.[0] || '?'}
                                            </AvatarFallback>
                                        </Avatar>
                                    )}

                                    <div className="flex-1 max-w-[70%]">
                                        {message.deleted_at ? (
                                            <DeletedMessage
                                                isAdmin={permissions.role === 'admin' || permissions.isSuperAdmin}
                                                originalContent={message.content}
                                                deletedAt={message.deleted_at}
                                            />
                                        ) : (
                                            <Card className={cn(
                                                "p-3 shadow-sm relative",
                                                isMe
                                                    ? "bg-primary text-primary-foreground"
                                                    : isCreator
                                                        ? "bg-red-500/10 border-red-500/30"
                                                        : "bg-blue-500/10 border-blue-500/30"
                                            )}>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1">
                                                        {!isMe && (
                                                            <p className="text-xs font-semibold mb-1 opacity-80">
                                                                {message.sender?.full_name}
                                                            </p>
                                                        )}
                                                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                                        <p className={cn(
                                                            "text-[10px] mt-1",
                                                            isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                                                        )}>
                                                            {format(new Date(message.created_at), 'HH:mm')}
                                                        </p>
                                                    </div>
                                                    <MessageActionMenu
                                                        debateId={roomId}
                                                        messageId={message.id}
                                                        messageContent={message.content}
                                                        messageSenderId={message.sender_id}
                                                    />
                                                </div>
                                            </Card>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* INPUT - Fijo abajo */}
            {
                isParticipant && (
                    <div style={inputAreaStyle}>
                        {restriction.isRestricted ? (
                            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/50 rounded-md text-red-600 dark:text-red-400">
                                <span className="font-semibold text-sm">
                                    {restriction.type === 'banned' ? 'Estás baneado de este debate.' : `Estás silenciado temporalmente.`}
                                </span>
                                <span className="text-xs opacity-90">
                                    Razón: {restriction.reason}
                                    {restriction.remainingMinutes && ` • Expira en ${restriction.remainingMinutes} min`}
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Input
                                    placeholder="Escribe un mensaje..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                    className="flex-1"
                                    disabled={sending}
                                />
                                <Button
                                    onClick={handleSendMessage}
                                    disabled={!newMessage.trim() || sending}
                                    className="bg-gradient-to-r from-green-800 to-teal-600 text-white"
                                >
                                    {sending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    );
}

