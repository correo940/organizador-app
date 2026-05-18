'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, PieChart, Calendar as CalendarIcon, TrendingUp, Users, Shield, MapPin, Building2, UserCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { startOfYear, endOfYear, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface WorkShift {
    id: string;
    start_time: string;
    title: string;
    description?: string;
    color?: string;
}

interface RosterStatisticsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentMonthShifts: WorkShift[];
    currentMonthDate: Date;
}

export default function RosterStatisticsDialog({ open, onOpenChange, currentMonthShifts, currentMonthDate }: RosterStatisticsDialogProps) {
    const [activeTab, setActiveTab] = useState('monthly');
    const [yearShifts, setYearShifts] = useState<WorkShift[]>([]);
    const [isLoadingYear, setIsLoadingYear] = useState(false);

    // Fetch yearly data when tab changes to 'yearly'
    useEffect(() => {
        if (open && activeTab === 'yearly' && yearShifts.length === 0) {
            fetchYearlyShifts();
        }
    }, [open, activeTab]);

    const fetchYearlyShifts = async () => {
        setIsLoadingYear(true);
        const start = startOfYear(new Date());
        const end = endOfYear(new Date());

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('work_shifts')
            .select('*')
            .eq('user_id', user.id)
            .gte('start_time', start.toISOString())
            .lte('start_time', end.toISOString());

        if (data) {
            setYearShifts(data);
        }
        setIsLoadingYear(false);
    };

    const calculateStats = (shifts: WorkShift[]) => {
        const typeStats: { [key: string]: { count: number, color: string } } = {};
        const serviceStats: { [key: string]: number } = {};
        const colleagueStats: { [key: string]: number } = {};

        shifts.forEach(shift => {
            // 1. Shift Types (e.g. "MAÑANA", "TARDE", "NOCHE")
            // Remove "Turno: " and remove any content in parentheses
            let name = shift.title.replace('Turno: ', '').trim();
            if (name.includes('(')) {
                name = name.split('(')[0].trim();
            }

            if (!typeStats[name]) {
                typeStats[name] = { count: 0, color: shift.color || '#gray' };
            }
            typeStats[name].count++;

            // 2. Services (Dynamic Extraction from Parentheses)
            // Look for content inside parens in title or explicit keywords
            const combinedText = (shift.title + ' ' + (shift.description || '')).toUpperCase();

            // Extract from Title: "Turno: TARDE (SUBDELEGACION)" -> "SUBDELEGACION"
            const match = shift.title.match(/\((.*?)\)/);
            if (match && match[1]) {
                const serviceName = match[1].trim().toUpperCase();
                serviceStats[serviceName] = (serviceStats[serviceName] || 0) + 1;
            } else {
                // Fallback for legacy manually added keywords if no parens found
                if (combinedText.includes('PUERTAS')) serviceStats['PUERTAS'] = (serviceStats['PUERTAS'] || 0) + 1;
                else if (combinedText.includes('PRESOS')) serviceStats['PRESOS'] = (serviceStats['PRESOS'] || 0) + 1;
                else if (combinedText.includes('SUBDELEGACION') || combinedText.includes('SUBDELEGACIÓN')) {
                    serviceStats['SUBDELEGACION'] = (serviceStats['SUBDELEGACION'] || 0) + 1;
                }
                else if (combinedText.includes('CENTRO') || combinedText.includes('PENITENCIARIO')) {
                    serviceStats['CENTRO'] = (serviceStats['CENTRO'] || 0) + 1;
                }
                else if (combinedText.includes('SALIENTE')) {
                    serviceStats['SALIENTE'] = (serviceStats['SALIENTE'] || 0) + 1;
                }
            }

            // 3. Colleagues
            if (shift.description && shift.description.includes('Con: ')) {
                const parts = shift.description.split('Con: ');
                if (parts.length > 1) {
                    const namesStr = parts[1];
                    const names = namesStr.split(',').map(n => n.trim()).filter(n => n.length > 2);
                    names.forEach(n => {
                        colleagueStats[n] = (colleagueStats[n] || 0) + 1;
                    });
                }
            }
        });

        // Convert/Sort Types
        const types = Object.entries(typeStats)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.count - a.count);

        // Convert/Sort Services (only > 0)
        const services = Object.entries(serviceStats)
            .filter(([_, count]) => count > 0)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        // Convert/Sort Colleagues
        const colleagues = Object.entries(colleagueStats)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Top 10

        return { types, services, colleagues };
    };

    const StatsGrid = ({ shifts }: { shifts: WorkShift[] }) => {
        const { types, services, colleagues } = calculateStats(shifts);

        // Calculate total days (count unique days with shifts?) or just total shifts
        const total = shifts.length;

        if (total === 0) {
            return <div className="text-center py-8 text-muted-foreground">No hay turnos registrados en este periodo.</div>;
        }

        const getServiceIcon = (name: string) => {
            const n = name.toUpperCase();
            if (n.includes('PUERTAS')) return <DoorOpenIcon className="h-4 w-4" />;
            if (n.includes('PRESOS')) return <UserCheck className="h-4 w-4" />;
            if (n.includes('SUBDELEGACI')) return <Shield className="h-4 w-4" />;
            if (n.includes('CENTRO') || n.includes('PENITENCIARIO')) return <Building2 className="h-4 w-4" />;
            return <MapPin className="h-4 w-4" />;
        };

        return (
            <div className="space-y-6">
                {/* SECTION 1: SHIFT TYPES */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <PieChart className="h-4 w-4" /> Tipos de Turno
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <Card className="bg-primary/5 border-primary/20">
                            <CardHeader className="p-3 pb-1">
                                <CardTitle className="text-xs font-medium text-muted-foreground uppercase text-center">Total</CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 text-center">
                                <div className="text-2xl font-bold">{total}</div>
                            </CardContent>
                        </Card>
                        {types.map((stat) => (
                            <Card key={stat.name} style={{ borderTop: `3px solid ${stat.color}` }}>
                                <CardHeader className="p-3 pb-1">
                                    <CardTitle className="text-xs font-medium text-muted-foreground uppercase truncate text-center" title={stat.name}>
                                        {stat.name}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 pt-0 text-center">
                                    <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.count}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {((stat.count / total) * 100).toFixed(0)}%
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {services.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 border-t pt-4">
                            <MapPin className="h-4 w-4" /> Lugares
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {services.map((stat) => (
                                <Card key={stat.name} className="bg-slate-50 dark:bg-slate-900 overflow-hidden">
                                    <CardContent className="p-2.5 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="p-1.5 bg-background rounded-full shrink-0 border">
                                                {getServiceIcon(stat.name)}
                                            </div>
                                            <span className="text-xs font-medium capitalize leading-tight break-words text-wrap">
                                                {stat.name.toLowerCase()}
                                            </span>
                                        </div>
                                        <span className="text-lg font-bold shrink-0">{stat.count}</span>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* SECTION 3: COLLEAGUES */}
                {colleagues.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 border-t pt-4">
                            <Users className="h-4 w-4" /> Top Compañeros
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {colleagues.map((col, idx) => (
                                <div key={col.name} className="flex items-center justify-between p-2 rounded border bg-card text-sm">
                                    <div className="flex items-center gap-3">
                                        <span className={`
                                            flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                                            ${idx === 0 ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                                idx === 1 ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                                                    idx === 2 ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                                        'bg-muted text-muted-foreground'}
                                        `}>
                                            {idx + 1}
                                        </span>
                                        <span className="font-medium truncate max-w-[150px]" title={col.name}>{col.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <span className="font-bold text-foreground">{col.count}</span> turnos
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PieChart className="h-5 w-5 text-primary" />
                        Estadísticas Detalladas
                    </DialogTitle>
                    <DialogDescription>
                        Análisis de turnos, servicios y compañeros.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="monthly">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            Mes Actual ({format(currentMonthDate, 'MMMM', { locale: es })})
                        </TabsTrigger>
                        <TabsTrigger value="yearly">
                            <TrendingUp className="mr-2 h-4 w-4" />
                            Año {format(new Date(), 'yyyy')}
                        </TabsTrigger>
                    </TabsList>

                    <div className="mt-4 flex-1 overflow-y-auto pr-1">
                        <TabsContent value="monthly" className="m-0">
                            <StatsGrid shifts={currentMonthShifts} />
                        </TabsContent>

                        <TabsContent value="yearly" className="m-0">
                            {isLoadingYear ? (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                    <p>Calculando estadísticas anuales...</p>
                                </div>
                            ) : (
                                <StatsGrid shifts={yearShifts} />
                            )}
                        </TabsContent>
                    </div>
                </Tabs>

                <DialogFooter>
                    <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// Simple internal icon for door
function DoorOpenIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M13 4h3a2 2 0 0 1 2 2v14" />
            <path d="M2 20h3" />
            <path d="M13 20h9" />
            <path d="M10 12v.01" />
            <path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z" />
        </svg>
    )
}
