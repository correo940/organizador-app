"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSuperAdmin } from '@/lib/hooks/useSuperAdmin';
import { usePendingReports } from '@/lib/hooks/usePendingReports';
import {
    Shield,
    Search,
    Eye,
    Trash2,
    Users,
    MessageSquare,
    AlertTriangle,
    Clock,
    Crown
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DebateWithStats {
    id: string;
    topic: string;
    status: 'waiting' | 'active' | 'voting' | 'finished';
    created_at: string;
    creator_id: string;
    is_public: boolean;
    message_count: number;
    pending_report_count: number;
    creator: { full_name: string } | null;
}

export default function DebateAdminPage() {
    const { isSuperAdmin, loading: authLoading } = useSuperAdmin();
    const [debates, setDebates] = useState<DebateWithStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'active' | 'waiting' | 'finished' | 'reported'>('all');

    useEffect(() => {
        if (!authLoading && isSuperAdmin) {
            fetchAllDebates();
        }
    }, [authLoading, isSuperAdmin, filter]);

    const fetchAllDebates = async () => {
        try {
            setLoading(true);

            // Fetch all debates (super admin can see everything)
            let query = supabase
                .from('debate_rooms')
                .select('*')
                .order('created_at', { ascending: false });

            // Apply status filter on server-side if it's a standard status
            if (filter !== 'all' && filter !== 'reported') {
                query = query.eq('status', filter);
            }

            const { data: debatesData, error } = await query;

            if (error) throw error;

            if (!debatesData) {
                setDebates([]);
                return;
            }

            // Get stats for each debate
            const debatesWithStats = await Promise.all(
                debatesData.map(async (debate) => {
                    // Count messages
                    const { count: messageCount } = await supabase
                        .from('debate_messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('room_id', debate.id);

                    // Get creator info
                    const { data: creator } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', debate.creator_id)
                        .single();

                    // Get pending reports count
                    const { count: reportCount } = await supabase
                        .from('debate_reports')
                        .select('*', { count: 'exact', head: true })
                        .eq('debate_id', debate.id)
                        .eq('status', 'pending');

                    return {
                        ...debate,
                        message_count: messageCount || 0,
                        pending_report_count: reportCount || 0,
                        creator,
                    };
                })
            );

            // Apply 'reported' filter client-side if needed since we can't easily do it in initial query without join
            const finalDebates = filter === 'reported'
                ? debatesWithStats.filter(d => d.pending_report_count > 0)
                : debatesWithStats;

            setDebates(finalDebates);
        } catch (error) {
            console.error('Error fetching debates:', error);
            toast.error('Error al cargar debates');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteDebate = async (debateId: string) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este debate?')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('debate_rooms')
                .delete()
                .eq('id', debateId);

            if (error) throw error;

            toast.success('Debate eliminado');
            fetchAllDebates();
        } catch (error) {
            console.error('Error deleting debate:', error);
            toast.error('Error al eliminar debate');
        }
    };

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <Shield className="w-12 h-12 animate-pulse text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Verificando permisos...</p>
                </div>
            </div>
        );
    }

    if (!isSuperAdmin) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Card className="p-8 text-center max-w-md">
                    <AlertTriangle className="w-16 h-16 text-destructive mx-auto mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Acceso Denegado</h1>
                    <p className="text-muted-foreground">
                        No tienes permisos para acceder a esta página.
                    </p>
                </Card>
            </div>
        );
    }

    const filteredDebates = debates.filter(debate =>
        debate.topic.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const stats = {
        total: debates.length,
        active: debates.filter(d => d.status === 'active').length,
        waiting: debates.filter(d => d.status === 'waiting').length,
        finished: debates.filter(d => d.status === 'finished').length,
        reported: debates.filter(d => d.pending_report_count > 0).length,
    };

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-full">
                        <Crown className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black">Panel de Super Administrador</h1>
                        <p className="text-muted-foreground">Gestión global de debates</p>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <Card className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Total</p>
                            <p className="text-2xl font-bold">{stats.total}</p>
                        </div>
                        <MessageSquare className="w-8 h-8 text-primary" />
                    </div>
                </Card>
                <Card className="p-4 bg-green-500/5 border-green-500/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Activos</p>
                            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                        </div>
                        <Users className="w-8 h-8 text-green-600" />
                    </div>
                </Card>
                <Card className="p-4 bg-yellow-500/5 border-yellow-500/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Esperando</p>
                            <p className="text-2xl font-bold text-yellow-600">{stats.waiting}</p>
                        </div>
                        <Clock className="w-8 h-8 text-yellow-600" />
                    </div>
                </Card>
                <Card className="p-4 bg-gray-500/5 border-gray-500/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Finalizados</p>
                            <p className="text-2xl font-bold text-gray-600">{stats.finished}</p>
                        </div>
                        <Shield className="w-8 h-8 text-gray-600" />
                    </div>
                </Card>
                <Card className="p-4 bg-destructive/5 border-destructive/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-muted-foreground">Reportados</p>
                            <p className="text-2xl font-bold text-destructive">{stats.reported}</p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-destructive" />
                    </div>
                </Card>
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar debates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {(['all', 'active', 'waiting', 'finished', 'reported'] as const).map((f) => (
                        <Button
                            key={f}
                            variant={filter === f ? 'default' : 'outline'}
                            onClick={() => setFilter(f)}
                            size="sm"
                            className={cn(
                                f === 'reported' && filter !== 'reported' && "text-destructive border-destructive/50 hover:bg-destructive/10"
                            )}
                        >
                            {f === 'all' ? 'Todos' :
                                f === 'active' ? 'Activos' :
                                    f === 'waiting' ? 'Esperando' :
                                        f === 'finished' ? 'Finalizados' :
                                            'Reportados'}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Debates List */}
            {loading ? (
                <div className="text-center py-12">
                    <Shield className="w-12 h-12 animate-pulse text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Cargando debates...</p>
                </div>
            ) : filteredDebates.length === 0 ? (
                <Card className="p-8 text-center">
                    <MessageSquare className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No se encontraron debates</p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filteredDebates.map((debate) => (
                        <AdminDebateItem
                            key={debate.id}
                            debate={debate}
                            onDelete={handleDeleteDebate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function AdminDebateItem({
    debate,
    onDelete
}: {
    debate: DebateWithStats;
    onDelete: (id: string) => void;
}) {
    const pendingReports = usePendingReports(debate.id);

    return (
        <Card className="p-4 hover:shadow-md transition-shadow relative">
            {/* Notification Badge for Admin Panel */}
            {pendingReports > 0 && (
                <span className="absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground shadow-sm ring-2 ring-background animate-pulse">
                    {pendingReports > 9 ? '9+' : pendingReports}
                </span>
            )}

            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-lg truncate">{debate.topic}</h3>
                        <Badge variant={
                            debate.status === 'active' ? 'default' :
                                debate.status === 'waiting' ? 'secondary' :
                                    debate.status === 'voting' ? 'outline' : 'destructive'
                        }>
                            {debate.status}
                        </Badge>
                        {debate.is_public && (
                            <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30 text-blue-600">
                                Público
                            </Badge>
                        )}
                        {pendingReports > 0 && (
                            <Badge variant="destructive" className="animate-in fade-in zoom-in">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                {pendingReports} Reportes
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            Creador: {debate.creator?.full_name || 'Desconocido'}
                        </span>
                        <span className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {debate.message_count} mensajes
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(debate.created_at), { addSuffix: true, locale: es })}
                        </span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link href={`/apps/debate?room=${debate.id}`}>
                        <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4 mr-2" />
                            Ver
                        </Button>
                    </Link>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(debate.id)}
                        className="text-destructive hover:bg-destructive/10"
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </Card>
    );
}
