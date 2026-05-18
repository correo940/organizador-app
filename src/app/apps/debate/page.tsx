"use client";

import { Suspense, useEffect, useState } from "react";
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from "next/navigation";
import { DebateRoomList } from "@/components/apps/debate/debate-room-list";
import { DebateRoomChat } from "@/components/apps/debate/debate-room-chat";
import { CreateDebateDialog } from "@/components/apps/debate/create-debate-dialog";
import { GuestDebateAccess } from "@/components/apps/debate/guest-debate-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Key, Search, MessageSquare, Crown } from "lucide-react";
import { useSuperAdmin } from "@/lib/hooks/useSuperAdmin";
import Link from "next/link";

export default function DebatePage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Cargando debate...</div>}>
            <DebateContent />
        </Suspense>
    );
}

function DebateContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const roomParam = searchParams?.get('room') ?? null;

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(roomParam);
    const [searchQuery, setSearchQuery] = useState("");
    const [showMobileChat, setShowMobileChat] = useState(!!roomParam);
    const { isSuperAdmin } = useSuperAdmin();

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        if (roomParam) {
            setSelectedRoomId(roomParam);
            setShowMobileChat(true);
        }
    }, [roomParam]);

    const handleRoomSelect = (roomId: string) => {
        setSelectedRoomId(roomId);
        setShowMobileChat(true);
        router.push(`/apps/debate?room=${roomId}`, { scroll: false });
    };

    const handleBackToList = () => {
        setShowMobileChat(false);
        setSelectedRoomId(null);
        router.push('/apps/debate', { scroll: false });
    };

    if (loading) return null;
    if (!user) return <GuestDebateAccess />;

    // CSS crítico como constantes para evitar problemas de carga
    const containerStyle: React.CSSProperties = {
        position: 'fixed',
        top: 65,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        backgroundColor: 'hsl(var(--background))',
        overflow: 'hidden',
        zIndex: 40
    };

    const sidebarStyle: React.CSSProperties = {
        display: showMobileChat ? 'none' : 'flex',
        flexDirection: 'column',
        width: 380,
        flexShrink: 0,
        borderRight: '1px solid hsl(var(--border))',
        height: '100%'
    };

    const chatPanelStyle: React.CSSProperties = {
        display: showMobileChat ? 'flex' : 'none',
        flex: 1,
        flexDirection: 'column',
        height: '100%',
        position: 'relative'
    };

    return (
        <>
            {/* Ocultar footer y mobile nav */}
            <style jsx global>{`
                footer, .fixed.bottom-0.md\\:hidden { display: none !important; }
            `}</style>

            <div style={containerStyle}>
                {/* SIDEBAR IZQUIERDO */}
                <div style={sidebarStyle} className="md:!flex bg-background">
                    {/* Header del Sidebar */}
                    <div className="flex-none p-4 border-b bg-gradient-to-r from-green-500 to-teal-600 text-white">
                        <div className="flex items-center gap-2 mb-4">
                            <MessageCircle className="w-6 h-6" />
                            <h1 className="text-2xl font-black">El Debate</h1>
                        </div>

                        <div className="flex gap-2 mb-4">
                            <CreateDebateDialog onDebateCreated={handleRoomSelect}>
                                <Button size="sm" className="flex-1 bg-white text-green-800 hover:bg-green-50 font-bold shadow-lg">
                                    <MessageCircle className="w-4 h-4 mr-2" />
                                    Nuevo
                                </Button>
                            </CreateDebateDialog>
                            <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
                                <Key className="w-4 h-4 mr-2" />
                                Código
                            </Button>
                            {isSuperAdmin && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-yellow-600 hover:from-yellow-600 hover:to-amber-600"
                                    title="Panel de Super Admin"
                                    asChild
                                >
                                    <Link href="/apps/debate/admin">
                                        <Crown className="w-4 h-4" />
                                    </Link>
                                </Button>
                            )}
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                            <Input
                                placeholder="Buscar debates..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60"
                            />
                        </div>
                    </div>

                    {/* Lista de Debates */}
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        <DebateRoomList
                            currentUserId={user.id}
                            selectedRoomId={selectedRoomId}
                            onRoomSelect={handleRoomSelect}
                        />
                    </div>
                </div>

                {/* PANEL DERECHO - CHAT */}
                <div style={chatPanelStyle} className="md:!flex bg-background">
                    {selectedRoomId ? (
                        <DebateRoomChat
                            roomId={selectedRoomId}
                            onBack={handleBackToList}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                            <div className="bg-gradient-to-br from-green-500 to-teal-500 p-6 rounded-full mb-6 shadow-xl">
                                <MessageSquare className="w-16 h-16 text-white" />
                            </div>
                            <h2 className="text-3xl font-black mb-3 bg-gradient-to-r from-green-800 to-teal-600 bg-clip-text text-transparent">
                                Bienvenido a El Debate
                            </h2>
                            <p className="text-muted-foreground max-w-md mb-6">
                                Selecciona un debate de la lista o crea uno nuevo para comenzar.
                            </p>
                            <CreateDebateDialog onDebateCreated={handleRoomSelect}>
                                <Button className="bg-gradient-to-r from-green-800 to-teal-600 text-white font-bold shadow-lg">
                                    <MessageCircle className="w-5 h-5 mr-2" />
                                    Crear Nuevo Debate
                                </Button>
                            </CreateDebateDialog>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

