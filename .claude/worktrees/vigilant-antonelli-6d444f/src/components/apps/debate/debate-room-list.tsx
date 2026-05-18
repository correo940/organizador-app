"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Users, Clock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePendingReports } from "@/lib/hooks/usePendingReports";

interface DebateRoom {
    id: string;
    topic: string;
    status: 'waiting' | 'active' | 'voting' | 'finished';
    is_public: boolean;
    created_at: string;
    creator_id: string;
    guest_id: string | null;
    creator: { full_name: string; avatar_url: string } | null;
    guest: { full_name: string; avatar_url: string } | null;
}

interface DebateRoomListProps {
    currentUserId: string;
    selectedRoomId: string | null;
    onRoomSelect: (roomId: string) => void;
}

export function DebateRoomList({ currentUserId, selectedRoomId, onRoomSelect }: DebateRoomListProps) {
    const [rooms, setRooms] = useState<DebateRoom[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRooms = async () => {
            // Fetch rooms without relations
            const { data, error } = await supabase
                .from('debate_rooms')
                .select('*')
                .or(`creator_id.eq.${currentUserId},guest_id.eq.${currentUserId}`)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching rooms:', error);
                setLoading(false);
                return;
            }

            if (data && data.length > 0) {
                // Get all unique user IDs (creators and guests)
                const userIds = [...new Set([
                    ...data.map(r => r.creator_id),
                    ...data.filter(r => r.guest_id).map(r => r.guest_id)
                ])].filter(Boolean);

                // Fetch all profiles at once
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url')
                    .in('id', userIds);

                const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

                // Add profile info to rooms
                const roomsWithProfiles = data.map(room => ({
                    ...room,
                    creator: profilesMap.get(room.creator_id) || null,
                    guest: room.guest_id ? profilesMap.get(room.guest_id) || null : null
                }));

                setRooms(roomsWithProfiles);
            } else {
                setRooms([]);
            }

            setLoading(false);
        };

        fetchRooms();

        // Real-time subscription
        const channel = supabase
            .channel('debate_rooms_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'debate_rooms'
            }, () => {
                fetchRooms();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUserId]);



    if (loading) {
        return (
            <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
                ))}
            </div>
        );
    }

    if (rooms.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
                <Trophy className="w-12 h-12 mb-4 opacity-50" />
                <p className="font-medium">No tienes debates aún</p>
                <p className="text-sm">Crea uno nuevo para empezar</p>
            </div>
        );
    }

    return (
        <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
                {rooms.map((room) => (
                    <DebateRoomListItem
                        key={room.id}
                        room={room}
                        currentUserId={currentUserId}
                        isSelected={room.id === selectedRoomId}
                        onSelect={() => onRoomSelect(room.id)}
                    />
                ))}
            </div>
        </ScrollArea>
    );
}

function DebateRoomListItem({
    room,
    currentUserId,
    isSelected,
    onSelect
}: {
    room: DebateRoom;
    currentUserId: string;
    isSelected: boolean;
    onSelect: () => void;
}) {
    const pendingReports = usePendingReports(room.id);
    const opponent = room.creator_id === currentUserId ? room.guest : room.creator;

    // Determine if we should show the badge (e.g., if user is Admin/Mod/Creator)
    // For now, if the user sees the debate in their list, and there are reports, they might want to know.
    // Or we can restrict it. The user said "aparezca aviso", implying for them (the admin/user).
    // Simpler to just show if count > 0.

    return (
        <Card
            onClick={onSelect}
            className={cn(
                "p-3 cursor-pointer transition-all hover:bg-accent border-l-4 relative",
                isSelected
                    ? "bg-accent border-l-green-500 shadow-sm"
                    : "border-l-transparent hover:border-l-green-300"
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate text-sm pr-6">
                        {room.topic}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" />
                        <span className="truncate">
                            vs {opponent?.full_name || "Esperando rival..."}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={room.status} />
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(room.created_at), {
                            addSuffix: true,
                            locale: es
                        })}
                    </div>
                </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                    {room.is_public ? "🌍 Público" : "🔒 Privado"}
                </Badge>

                {/* Notification Badge on Crown for Admin/Creator context or just general alert */}
                {pendingReports > 0 && (
                    <div className="flex items-center gap-1 bg-destructive/10 text-destructive px-2 py-0.5 rounded-full animate-in zoom-in">
                        <Trophy className="w-3 h-3 fill-current" />
                        <span className="text-[10px] font-bold">{pendingReports}</span>
                    </div>
                )}
            </div>

            {/* Alternative: Floating badge similar to chat */}
            {pendingReports > 0 && (
                <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-sm ring-2 ring-background animate-pulse">
                    {pendingReports > 9 ? '9+' : pendingReports}
                </span>
            )}
        </Card>
    );
}

function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case 'waiting':
            return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Esperando</Badge>;
        case 'active':
            return <Badge className="bg-green-500 text-white">En curso</Badge>;
        case 'voting':
            return <Badge className="bg-purple-500 text-white">Votación</Badge>;
        case 'finished':
            return <Badge variant="outline" className="bg-slate-500/10 text-slate-500">Finalizado</Badge>;
        default:
            return null;
    }
}

