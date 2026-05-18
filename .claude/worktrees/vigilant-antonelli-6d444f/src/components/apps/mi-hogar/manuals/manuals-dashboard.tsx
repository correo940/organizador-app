'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import { FileText, Star, Bell, AlertCircle, Calendar, TrendingUp, Droplet, ChefHat, Tv, Bed, Car, FolderOpen, Home } from 'lucide-react';
import { formatDistanceToNow, isBefore, addDays, addMonths } from 'date-fns';

const ICON_MAP: Record<string, any> = {
    'Droplet': Droplet,
    'ChefHat': ChefHat,
    'Tv': Tv,
    'Bed': Bed,
    'Car': Car,
    'FolderOpen': FolderOpen,
    'Home': Home,
    'bathroom': Droplet,
    'kitchen': ChefHat,
    'living': Tv,
    'bedroom': Bed,
    'garage': Car,
    'office': FolderOpen,
    'other': Home
};
import { es } from 'date-fns/locale';

interface Stats {
    totalManuals: number;
    favoritesCount: number;
    upcomingReminders: number;
    expiringWarranties: number;
    manualsByRoom: { id: string | null; name: string; count: number; icon?: string }[];
    recentReminders: { title: string; manual_title: string; next_date: string }[];
}

const EMPTY_STATS: Stats = {
    totalManuals: 0,
    favoritesCount: 0,
    upcomingReminders: 0,
    expiringWarranties: 0,
    manualsByRoom: [],
    recentReminders: []
};

export function ManualsDashboard({ selectedRoom, onSelectRoom }: { selectedRoom?: string | null; onSelectRoom?: (id: string | null) => void }) {
    const { user, loading: authLoading } = useAuth();
    const [stats, setStats] = useState<Stats>(EMPTY_STATS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setStats(EMPTY_STATS);
            setLoading(false);
            return;
        }
        fetchStats();
    }, [user, authLoading]);

    const fetchStats = async () => {
        try {
            setLoading(true);

            // Fetch manuals
            const { data: manuals, error: manualsError } = await supabase
                .from('manuals')
                .select(`
                    *,
                    room:rooms(id, name, icon)
                `);

            if (manualsError) throw manualsError;

            // Fetch rooms explicitly to show all of them even with 0
            const { data: rooms } = await supabase
                .from('rooms')
                .select('*');

            // Fetch upcoming reminders (next 30 days)
            const next30Days = addDays(new Date(), 30).toISOString().split('T')[0];
            const { data: reminders } = await supabase
                .from('manual_reminders')
                .select(`
                    *,
                    manual:manuals(title)
                `)
                .eq('is_active', true)
                .lte('next_date', next30Days)
                .order('next_date')
                .limit(4);

            // Calculate stats
            const totalManuals = manuals?.length || 0;
            const favoritesCount = manuals?.filter(m => m.is_favorite).length || 0;
            const upcomingReminders = reminders?.length || 0;

            // Warranties expiring in next 60 days
            const next60Days = addDays(new Date(), 60).toISOString().split('T')[0];
            const expiringWarranties = manuals?.filter(m =>
                m.warranty_expires && m.warranty_expires <= next60Days
            ).length || 0;

            // Group by room (preserving real ID)
            const roomCounts = new Map<string, { id: string | null; name: string; count: number; icon?: string }>();

            // initialize all rooms with 0
            rooms?.forEach(r => {
                roomCounts.set(r.id, { id: r.id, name: r.name, count: 0, icon: r.icon });
            });

            manuals?.forEach(manual => {
                const rID = manual.room?.id || 'unassigned';
                const current = roomCounts.get(rID) || { id: manual.room?.id || null, name: manual.room?.name || 'Sin asignar', count: 0, icon: manual.room?.icon };
                current.count++;
                roomCounts.set(rID, current);
            });

            setStats({
                totalManuals,
                favoritesCount,
                upcomingReminders,
                expiringWarranties,
                manualsByRoom: Array.from(roomCounts.values()).sort((a, b) => b.count - a.count), // show all
                recentReminders: reminders?.map(r => ({
                    title: r.title,
                    manual_title: r.manual?.title || '',
                    next_date: r.next_date
                })) || []
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[1, 2, 3, 4].map(i => (
                    <Card key={i} className="animate-pulse h-32"></Card>
                ))}
            </div>
        );
    }

    return (
        <div className="mb-10 space-y-6">

            {/* Bento Grid: At a Glance */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-white dark:bg-slate-900 shadow-lg border border-slate-100 dark:border-slate-800 hover:shadow-xl transition-all duration-500 hover:scale-[1.02] rounded-[2rem] overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
                    <CardContent className="p-6 flex flex-col justify-between h-full relative z-10">
                        <div className="p-3 bg-green-500/10 rounded-2xl w-fit mb-4">
                            <FileText className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                            <div className="text-4xl font-black tracking-tight text-slate-800 dark:text-white">{stats.totalManuals}</div>
                            <div className="font-bold text-green-800 dark:text-green-400 uppercase tracking-widest text-[10px] mt-1">Activos Protegidos</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className={`border-none shadow-lg hover:shadow-xl transition-all duration-500 hover:scale-[1.02] rounded-[2rem] overflow-hidden relative ${stats.expiringWarranties > 0 ? 'bg-gradient-to-br from-rose-500 to-rose-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800'}`}>
                    <CardContent className="p-6 flex flex-col justify-between h-full relative z-10">
                        <div className={`p-3 rounded-2xl w-fit mb-4 ${stats.expiringWarranties > 0 ? 'bg-white/20' : 'bg-rose-500/10 dark:bg-rose-500/20'}`}>
                            <AlertCircle className={`w-6 h-6 ${stats.expiringWarranties > 0 ? 'text-white' : 'text-rose-500'}`} />
                        </div>
                        <div>
                            <div className={`text-4xl font-black tracking-tight ${stats.expiringWarranties > 0 ? 'drop-shadow-md' : 'text-slate-800 dark:text-white'}`}>{stats.expiringWarranties}</div>
                            <div className={`font-bold uppercase tracking-widest text-[10px] mt-1 ${stats.expiringWarranties > 0 ? 'text-rose-200' : 'text-muted-foreground'}`}>Garantías (60 días)</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className={`border-none shadow-lg hover:shadow-xl transition-all duration-500 hover:scale-[1.02] rounded-[2rem] overflow-hidden relative ${stats.upcomingReminders > 0 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-amber-950' : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800'}`}>
                    <CardContent className="p-6 flex flex-col justify-between h-full relative z-10">
                        <div className={`p-3 rounded-2xl w-fit mb-4 ${stats.upcomingReminders > 0 ? 'bg-black/10' : 'bg-amber-500/10'}`}>
                            <Bell className={`w-6 h-6 ${stats.upcomingReminders > 0 ? 'text-amber-950' : 'text-amber-500'}`} />
                        </div>
                        <div>
                            <div className={`text-4xl font-black tracking-tight ${stats.upcomingReminders > 0 ? 'drop-shadow-md' : 'text-slate-800 dark:text-white'}`}>{stats.upcomingReminders}</div>
                            <div className={`font-bold uppercase tracking-widest text-[10px] mt-1 ${stats.upcomingReminders > 0 ? 'text-amber-900/80' : 'text-muted-foreground'}`}>Mantenimientos</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-slate-900 shadow-lg border border-slate-100 dark:border-slate-800 hover:shadow-xl transition-all duration-500 hover:scale-[1.02] rounded-[2rem] overflow-hidden relative">
                    <div className="absolute bottom-0 right-0 w-24 h-24 bg-green-500/10 rounded-full blur-2xl -mr-5 -mb-5" />
                    <CardContent className="p-6 flex flex-col justify-between h-full relative z-10">
                        <div className="p-3 bg-green-500/10 rounded-2xl w-fit mb-4">
                            <Star className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                            <div className="text-4xl font-black tracking-tight text-slate-800 dark:text-white">{stats.favoritesCount}</div>
                            <div className="font-bold text-muted-foreground uppercase tracking-widest text-[10px] mt-1">Activos VIP</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Room Filters mimicking Folders */}
            <div>
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-3">Tus Espacios</h3>
                <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                    {/* All Rooms */}
                    <div
                        onClick={() => onSelectRoom && onSelectRoom(null)}
                        className={`cursor-pointer flex-shrink-0 w-32 h-32 rounded-3xl p-4 flex flex-col justify-between transition-all ${!selectedRoom ? 'bg-green-800 text-white shadow-xl shadow-green-800/20 scale-100' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:scale-105'}`}
                    >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${!selectedRoom ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                            <FolderOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-sm">Todos</h4>
                            <p className={`text-xs ${!selectedRoom ? 'text-green-100' : 'text-slate-400'}`}>{stats.totalManuals} items</p>
                        </div>
                    </div>

                    {/* Specific Rooms */}
                    {stats.manualsByRoom.filter(r => r.id !== null).map((room) => {
                        const isSelected = selectedRoom === room.id;
                        const Icon = ICON_MAP[room.icon || ''] || Home;
                        return (
                            <div
                                key={room.name}
                                onClick={() => onSelectRoom && onSelectRoom(room.id)}
                                className={`cursor-pointer flex-shrink-0 w-32 h-32 rounded-3xl p-4 flex flex-col justify-between transition-all ${isSelected ? 'bg-green-800 text-white shadow-xl shadow-green-800/20 scale-100' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:scale-105 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSelected ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm truncate">{room.name}</h4>
                                    <p className={`text-xs ${isSelected ? 'text-green-100' : 'text-slate-400'}`}>{room.count} items</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Quick Next Actions if any alarms are active */}
            {stats.recentReminders.length > 0 && (
                <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/50 rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-amber-800 dark:text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Bell className="w-4 h-4" /> Alertas de Mantenimiento Requeridas
                    </h3>
                    <div className="flex flex-col gap-2">
                        {stats.recentReminders.map((reminder, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-900 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
                                <div>
                                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{reminder.title}</p>
                                    <p className="text-xs text-muted-foreground">{reminder.manual_title}</p>
                                </div>
                                <Badge variant="destructive" className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none rounded-lg px-3 py-1 text-xs font-semibold">
                                    {formatDistanceToNow(new Date(reminder.next_date), { addSuffix: true, locale: es })}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

